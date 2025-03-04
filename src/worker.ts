import amqplib from 'amqplib';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import { Message } from './models/Messages';

dotenv.config();

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const QUEUE_NAME = process.env.QUEUE_NAME;

const recieveMessage = async () => {
    try {

        await connectDB(); // Connect to MongoDB

        if (!RABBITMQ_URL) {
            throw new Error("RABBITMQ_URL is not defined");
        }
        
        if (!QUEUE_NAME) {
            throw new Error("QUEUE_NAME is not defined");
        }

        const connection = await amqplib.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();

        await channel.assertQueue(QUEUE_NAME, { durable: true });

        console.log(`Waiting for messages in ${QUEUE_NAME}...`);

        channel.consume(QUEUE_NAME, (msg) => {
            if (msg) {
                // const message = msg.content.toString();
                // console.log(`Received: ${message}`);

                const data = JSON.parse(msg.content.toString());
                console.log(data);
                console.log(`Received: ${data.content}`);

                // Simulate message processing
                setTimeout(async () => {
                    // console.log(`Processed: ${message}`);

                    // Update message status in MongoDB
                    await Message.findByIdAndUpdate(data.id, { status: 'processed' });
                    console.log(`Processed: ${data.content}`);

                    channel.ack(msg);
                }, 2000);
            }
        });
    } catch(e) {
        console.error("Error in consumer:", e);
    }
}

recieveMessage();