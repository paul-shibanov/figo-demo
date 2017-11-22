const figo = require('figo');
const sleep = ms => new Promise(res => setTimeout(res, ms));

const loadConfig = () => require('./config');

const createConnection = (clientId, clientSecret) => {
    return new Promise((resolve, reject) => {
        try {
            const connection = new figo.Connection(clientId, clientSecret);
            resolve(connection);
        } catch (e) {
            reject(e);
        }
    });
};

const createUser = (connection, name, email, password) => {
    return new Promise((resolve, reject) => {
        connection.create_user(name, email, password, null, null, (error, sth) => {
            if (error) {
                reject(error);
            } else {
                resolve(sth);
            }
        });
    });
};

const login = (connection, email, password) => {
    return new Promise((resolve, reject) => {
        connection.credential_login(email, password, null, null, null, null, (error, token) => {
            if (error) {
                reject(error);
            } else {
                resolve(token);
            }
        });
    });
};

const createSession = (token) => {
    return new Promise((resolve, reject) => {
        try {
            const session = new figo.Session(token);
            resolve(session);
        } catch (e) {
            reject(e);
        }
    });
};

const connectAccount = async (session, country, credentials, bank_code, iban, save_pin) => {
    let task;
    try {
        task = await new Promise((resolve, reject) => {
            session.add_account(country, credentials, bank_code, iban, save_pin, async (error, task) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(await recursivePool(session, task));
                }
            });
        });
        return task;
    } catch (e) {
        throw e;
    }
};

const getAccounts = (session) => {
    return new Promise((resolve, reject) => {
        session.get_accounts((error, accounts) => {
            if (error) {
                reject(error);
            } else {
                resolve(accounts);
            }
        });
    });
};

const getTransactions = (session) => {
    return new Promise((resolve, reject) => {
        session.get_transactions(null, (error, transactions) => {
            if (error) {
                reject(error);
            } else {
                resolve(transactions);
            }
        });
    });
};

const getStandingOrders = (session) => {
    return new Promise((resolve, reject) => {
        session.get_standing_orders(false, (error, standingOrders) => {
            if (error) {
                reject(error);
            } else {
                resolve(standingOrders);
            }
        });
    });
};

const removeUser = (session) => {
    return new Promise((resolve, reject) => {
        session.remove_user((error, sth) => {
            if (error) {
                reject(error);
            } else {
                resolve(sth);
            }
        });
    });
};

const seq = async () => {
    let connection;
    const config = loadConfig();
    try {
        connection = await createConnection(config.app.client_id, config.app.client_secret);
    } catch (e) {
        console.error(e);
    }
    let figoUser;
    try {
        figoUser = await createUser(connection, config.user.name, config.user.email, config.user.password);
    } catch (e) {
        const USER_EXISTS = 1001;
        if (e.error.code === USER_EXISTS) {
            console.warn('User already exists.');
        } else {
            throw e;
        }
    }
    let accessToken;
    try {
        accessToken = await login(connection, config.user.email, config.user.password);
    } catch (e) {
        console.error(e);
    }
    let session;
    try {
        session = await createSession(accessToken.access_token)
    } catch (e) {
        console.error(e);
    }
    let task;
    try {
        task = await connectAccount(session,
            config.account.country,
            config.account.credentials,
            config.account.bank_code,
            config.account.iban || null,
            config.account.save_pin);
    } catch (e) {
        console.error(e);
    }

    let accounts;
    try {
        accounts = await getAccounts(session);
    } catch (e) {
        console.error(e);
    }
    console.log(accounts);
};


async function recursivePool(session, task, taskStatus) {
    if (taskStatus) {
        sleep(1000);
    }
    try {
        taskStatus = await new Promise((resolve, reject) => {
            session.get_task_state(task, null, (error, x) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(x);
                }
            });
        });
    } catch (e) {
        throw e;
    }
    if (taskStatus.is_ended) {
        return taskStatus;
    }
    return await recursivePool(session, task, taskStatus);
}

seq();
