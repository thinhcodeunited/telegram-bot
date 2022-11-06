const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    name : {
        type: String,
        trim: true,
        default: null
    },
    member_id: {
        type: String,
        trim: true,
        default: null
    },
    chat_id: {
        type: String,
        trim: true,
        default: null
    }
}, {
    timestamps: {
        createdAt: "created_at",
        updatedAt: "updated_at",
    }
});

module.exports = mongoose.model('Orders', OrderSchema);