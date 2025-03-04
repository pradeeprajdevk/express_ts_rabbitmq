import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'processed'],
        default: 'pending'
    },
    createdAt: { type: Date, default: Date.now },
});

export const Message = mongoose.model('Message', MessageSchema);