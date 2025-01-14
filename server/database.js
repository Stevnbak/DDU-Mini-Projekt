const sqlite3 = require('sqlite3').verbose();

let db = new sqlite3.Database('./users.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the database.');
});

//User...
function addUserInfo(email, username, password, teacher) {
    let teachBool = teacher ? 1 : 0;
    ///console.log('Adding user: [Email:' + email + ' Username:' + username + ' Password:' + password + ' Teacher:' + teacher + ']');
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO users (username, email, password, teacher) VALUES (?, ?, ?, ?)', [username, email, password, teachBool], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}
function getUserClass(userId) {
    return new Promise((resolve, reject) => {
        db.all('SELECT classId,className,inviteCode from dist LEFT join class on dist.classId = class.id WHERE userId = ?', [userId], function (err, result, fields) {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}
//Class...
function addClass(className, inviteCode) {
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO class (className, inviteCode) VALUES (?, ?)', [className, inviteCode], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}
function addUserClass(id, inviteCode) {
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO dist (UserId, classId) VALUES (?, (SELECT id FROM class WHERE inviteCode = ?))', [id, inviteCode], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(true);
            }
        });
    });
}

//
function checkClassJoin(id, inviteCode) {
    return new Promise((resolve, reject) => {
        db.all(
            'select case when exists (SELECT inviteCode FROM class where inviteCode = ?) then 1 else 0 end as eks,case when exists (SELECT 1 from dist where userId = ? and classId = (SELECT id from class where inviteCode = ?)) then 1 else 0 end as joined',
            [inviteCode, id, inviteCode],
            function (err, result, fields) {
                if (err) {
                    reject(err);
                } else {
                    if (result[0].eks == 0) {
                        reject('Der+findes+ingen+klasser+med+denne+kode');
                    } else if (result[0].joined == 1) {
                        reject('Allerede+en+del+af+denne+klasse');
                    } else {
                        //addUserClass(id, inviteCode)
                        ///console.log('Not joined and exists');
                        resolve(true);
                    }
                }
            }
        );
    });
}

function checkUserExists(email) {
    return new Promise((resolve, reject) => {
        db.all('select case when exists (SELECT email from users where email = ?) then 1 else 0 end as eks', [email], function (err, result, fields) {
            if (err) {
                reject(err);
            } else {
                if (result[0].eks == 1) {
                    resolve(true);
                } else {
                    ///console.log('exists');
                    resolve(false);
                }
            }
        });
    });
}

function getUserList(classId) {
    return new Promise((resolve, reject) => {
        db.all('select * from dist left join users on dist.userId = users.id where classId = ?', [classId], function (err, result, fields) {
            if (err) {
                reject(err);
            } else {
                let userList = [];
                for (let user in result) {
                    userList.push({username: result[user].username, id: result[user].userId});
                }
                resolve(userList);
            }
        });
    });
}
//Test...
function addTest(classId, questions, testName) {
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO tests (questions, testName) VALUES (?, ?)', [questions, testName], function (err) {
            if (err) {
                reject(err);
            } else {
                addClassTest(classId, testName); // burde nok tilføjes error handling til denne?
                resolve(true);
            }
        });
    });
}

function addTestFromName(className, questions, testName) {
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO tests (questions, testName) VALUES (?, ?)', [questions, testName], function (err) {
            if (err) {
                reject(err);
            } else {
                addClassTestFromName(className, testName); // burde nok tilføjes error handling til denne?
                resolve(true);
            }
        });
    });
}

function addClassTestFromName(className, testName) {
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO assignments (classId, testId) VALUES ((SELECT id FROM class WHERE className = ?), (SELECT id FROM tests WHERE testName = ?))', [className, testName], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(true);
            }
        });
    });
}

function testClassExist(className, questions, testName) {
    return new Promise((resolve, reject) => {
        db.all('select case when exists (SELECT className from class where className = ?) then 1 else 0 end as eks', [className], function (err, result) {
            if (err) {
                reject(err);
            } else {
                if (result[0].eks == 1) {
                    addTestFromName(className, questions, testName); // burde nok tilføjes error handling til denne?
                    resolve(true);
                } else {
                    reject('eksisterer ikke');
                }
            }
        });
    });
}

function addClassTest(classId, testName) {
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO assignments (classId, testId) VALUES (?, (SELECT id FROM tests WHERE name = ?))', [classId, testName], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(true);
            }
        });
    });
}
function addResults(userId, testId, date, result) {
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO results (userId,testId,date, result) VALUES (?, ?,?,?)', [userId, testId, date, JSON.stringify(result)], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(true);
            }
        });
    });
}
function getResults(testId, classId) {
    return new Promise((resolve, reject) => {
        getUserList(classId).then((users) => {
            //Get all results by user
            db.all('SELECT * FROM results WHERE testId = ?', [testId], function (err, results) {
                let testData = [];
                if (results) {
                    for (let result in results) {
                        let user = users.find((user) => user.id == results[result].userId);
                        if (user) {
                            testData.push({userId: results[result].userId, username: user.username, date: results[result].date, result: JSON.parse(results[result].result)});
                        }
                    }
                    //Add users from class with no results
                    for (let user in users) {
                        if (!testData.find((test) => test.userId == users[user].id)) {
                            testData.push({userId: users[user].id, username: users[user].username, date: null, result: null});
                        }
                    }
                    resolve(testData);
                } else {
                    reject(err);
                }
            });
        });
    });
}
function getTests(userId) {
    let testData = [];
    return new Promise((resolve, reject) => {
        //Classes
        getUserClass(userId)
            .then((classes) => {
                ///console.log('Classes: ');
                ///console.log(classes);
                new Promise((resolve, reject) => {
                    for (let i = 0; i < classes.length; i++) {
                        //Assignments
                        db.all('SELECT * FROM assignments WHERE classId = ?', [classes[i].classId], function (err, assignments) {
                            if (err) {
                                reject(err);
                            } else {
                                ///console.log('Assignments: ');
                                ///console.log(assignments);
                                new Promise((resolve, reject) => {
                                    for (let j = 0; j < assignments.length; j++) {
                                        //Tests
                                        db.get('SELECT * FROM tests WHERE id = ?', [assignments[j].testId], function (err, test) {
                                            if (err) {
                                                reject(err);
                                            } else {
                                                ///console.log('Test: ');
                                                ///console.log(test);
                                                testData.push({id: test.id, className: classes[i].className, classId: classes[i].classId, questions: test.questions, date: assignments[j].date});
                                                resolve();
                                            }
                                        });
                                    }
                                })
                                    .then(() => {
                                        resolve();
                                    })
                                    .catch((err) => {
                                        reject(err);
                                    });
                            }
                        });
                    }
                })
                    .then(() => {
                        ///console.log('Testdata: ');
                        ///console.log(testData);
                        resolve(testData);
                    })
                    .catch((err) => {
                        reject(err);
                    });
            })
            .catch((err) => {
                reject(err);
            });
    });
}
function getCompletedTests(userId) {
    return new Promise((resolve, reject) => {
        //Get all results by user
        db.all('SELECT * FROM results WHERE userId = ?', [userId], function (err, results) {
            let testData = [];
            if (results) {
                for (let result in results) {
                    testData.push(results[result].testId);
                }
                resolve(testData);
            } else {
                reject(err);
            }
        });
    });
}

//Login...
function checkUserInfo(email, password) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email, password], function (err, result, fields) {
            if (err) {
                reject(err);
            } else {
                if (!result) {
                    reject('Wrong email or password');
                } else {
                    resolve(result.id);
                }
            }
        });
    });
}
function addSession(userId, ip) {
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO sessions (userId, ip) VALUES (?, ?)', [userId, ip], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}
function checkSession(sessionId, ip) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM sessions WHERE id = ?', [sessionId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                if (row == undefined) {
                    reject('Session not found');
                } else {
                    if (row.ip == ip) {
                        db.get('SELECT * FROM users WHERE id = ?', [row.userId], (err, row) => {
                            if (err || row == undefined) {
                                reject(err);
                            } else {
                                resolve({id: row.id, name: row.username, teacher: row.teacher});
                            }
                        });
                    } else {
                        reject('Ip mismatch');
                    }
                }
            }
        });
    });
}

module.exports = {
    addUserInfo,
    getUserClass,
    checkUserInfo,
    addSession,
    checkSession,
    addUserClass,
    addClass,
    addClassTest,
    getUserList,
    addTest,
    addResults,
    getResults,
    getTests,
    checkClassJoin,
    getCompletedTests,
    checkUserExists,
    addTestFromName,
    testClassExist,
};
