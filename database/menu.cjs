const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
        default: null
    },
    set: {
        type: String,
        default: null
    },
    note: {
        type: String,
        default: null
    },
    price: {
        type: String,
        default:null
    },
    count: {
        type: String,
        default: null
    }
}, {
    timestamps: {
        createdAt: "created_at",
        updatedAt: "updated_at",
    }
});

module.exports = mongoose.model('Menus', menuSchema);