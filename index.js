var vow = require('vow'),
    connection = require('ssh2'),
    chokidar = require('chokidar');

/**
 *  отвечает за подключение по ssh
 *  @param options {Object} - конфиг для соединения
 *  @returns {Promise}
 */
var connect = function(options) {
    var defer = vow.defer();

    var c = new connection();

    c.on('connect', function () {
        console.log('Connection :: connect');
    });

    c.on('ready', function () {
        console.log('Connection :: ready');
        c.sftp(function (err, sftp) {
            (err) ? console.log('Sftp :: error' + err) : console.log('\x1B[32mSftp :: start\x1B[39m');
            defer.resolve(sftp);
        });
    });

    c.on('error', function (err) {
        console.log('Connection :: error ' + err);
    });

    c.on('end', function () {
        console.log('Connection :: end');
    });

    c.on('close', function () {
        console.log('Connection :: close');
    });

    c.connect(options);

    return defer.promise();
};

/**
 * @param options {Object} - конфиг для соединения
 * @param localPath {String} - локальный путь до каталога со статикой
 * @param remotePath {String}- удаленный путь до каталога со статикой
 * @param compile {Function}- функция которя исполняется после изменения файла перед его заливкой
 */
module.exports = function(options, localPath, remotePath, compile){
    connect(options).then(function(sftp){
        chokidar.watch(localPath, {ignoreInitial: true, persistent: true})

            .on('add', function (p) {
                console.log('Sftp :: upload added', p);
                sftp.fastPut(p, p.replace(localPath, remotePath), {}, function (err) {
                    if (err) {
                        console.log('Sftp :: upload err', err);
                    }
                });
            })

            .on('change', function (p) {
                console.log('Sftp :: upload changed', p);
                compile(p).then(function(data) {
                    if (typeof data == 'string') {
                        sftp.fastPut(data, p.replace(localPath, remotePath), {}, function (err) {
                            if (err) {
                                console.log('Sftp :: upload err', err);
                            }
                        });
                    } else {
                        var writable = sftp.createWriteStream(data.path.replace(localPath, remotePath));
                        writable.write(data.stream);
                        writable.on('end', function () {
                            writable.end();
                        });
                    }
                });
            })

            .on('addDir', function (p) {
                console.log('Sftp :: upload addDir', p);
                sftp.mkdir(p.replace(localPath, remotePath), function (err) {
                    if (err) {
                        console.log('Sftp :: upload err', err);
                    }
                });

            })

            .on('unlink', function (p) {
                console.log('Sftp :: unlink file', p);
                sftp.unlink(p.replace(localPath, remotePath), function (err) {
                    if (err) {
                        console.log('Sftp :: remove err', err);
                    }
                })

            })

            .on('unlinkDir', function (p) {
                console.log('Sftp :: unlink dir', p);
                sftp.rmdir(p.replace(localPath, remotePath), function (err) {
                    if (err) {
                        console.log('Sftp :: remove err', err);
                    }
                })

            })

            .on('error', function (error) {

                console.log('Sftp :: error: ', error);

            });
    });
};