/**
 * Connect mongoose database
 */
const mongoose = require('mongoose');

const auth = (process.env.DB_USER_DATABASE && process.env.DB_PASSWORD) ? `${process.env.DB_USER_DATABASE}:${process.env.DB_PASSWORD}@` : '';
/**
 * Connect mongoose DB.
 */   0 

mongoose.connect(`${process.env.DB_CONNECTION}://${auth}${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`,{});

mongoose.connection.on('connected', () => {
    console.log('Connected to mongo server.')
});
/**
 * Event listener for "error" event.
 */
mongoose.connection.on('error', (error) => {
    throw error;
});

module.exports = mongoose;


