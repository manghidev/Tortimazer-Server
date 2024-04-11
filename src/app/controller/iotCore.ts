import express from 'express';
import path from 'path';
import { mqtt as awsMqtt } from 'aws-iot-device-sdk-v2';
import { TextDecoder } from 'util';
import { iot as awsIot, mqtt } from 'aws-crt';
import { createServer } from 'http';
import { Server } from 'socket.io';
import crypto from "crypto";
import env from '../../config/env.config';

import { DynamoDBClient, ExecuteStatementCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const client = new DynamoDBClient([
    {
        region: env.AWS_REGION,
        credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY
        }
    }
]);

const app = express();
const socketServer = createServer(app);
const io = new Server(socketServer, {
    cors: {
        origin: '*',
    },
});

const iotCoreServer = async () => {
    const decoder = new TextDecoder('utf-8');

    const topics = [
        'client_to_server',
        'board_to_server',
        'server_to_clients',
        'server_to_boards',
        'board_to_server_ok'
    ];

    const certificate = path.join(__dirname, '../../keys', 'cert.pem');
    const privateKey = path.join(__dirname, '/../../keys', 'private.key');
    const rootCA = path.join(__dirname, '/../../keys', 'root-CA.crt');
    const thingName = env.AWS_IOT_CORE_THING_NAME ?? '';
    const endPoint = env.AWS_IOT_CORE_ENDPOINT ?? '';

    const config_builder = awsIot.AwsIotMqttConnectionConfigBuilder.new_mtls_builder_from_path(certificate, privateKey);

    config_builder.with_certificate_authority_from_path(undefined, rootCA);

    config_builder.with_clean_session(false);
    config_builder.with_client_id(thingName);
    config_builder.with_endpoint(endPoint);

    const connection = new mqtt.MqttClient().new_connection(config_builder.build());

    await connection.connect().then(() => {
        console.log("Connected to AWS IoT Core");
    }).catch((error) => console.log("Connect error: " + error));

    // * Method to listen to client connections
    io.on('connection', (socket) => {
        console.log(`User connected with id: ${socket.id}`);

        // * Method for listening to customer messages
        socket.on(topics[0], async (message) => {
            console.log("Received from client", message);

            message = JSON.parse(message);

            message = JSON.stringify({
                p: `${message.p}`,
            });

            // * The boards are notified
            await connection.publish(topics[3], message, awsMqtt.QoS.AtLeastOnce);
            console.log("Message sent to boards");
        });
    });

    // * Method to listen to the messages on the tablets
    await connection.subscribe(topics[1], awsMqtt.QoS.AtLeastOnce, async (topic, payload) => {
        const data = JSON.parse(decoder.decode(payload));
        console.log("Received from", topic, data);

        const dataCompany = (await client.send(new ExecuteStatementCommand({
            Statement: `SELECT * FROM "config-tortimazer" WHERE uid = '${env.UID_COMPANY}'`,
            ConsistentRead: true
        }))).Items?.map((record) => unmarshall(record));

        const date = new Date();

        const price = (dataCompany![0].pricePerKilo * data.tortillas) / 30;

        // * Save data in DynamoDB
        await client.send(new ExecuteStatementCommand({
            Statement: `
                INSERT INTO "record-tortimazer"
                value {
                    'uid': '${crypto.randomUUID({ disableEntropyCache: true })}',
                    'price': '${price}',
                    'uidCompany': '${env.UID_COMPANY}',
                    'tortillas': '${data.tortillas}',
                    'creationDate': '${date.getFullYear()}-${(date.getMonth() + 1) < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1}-${(date.getDate() < 10) ? '0' + date.getDate() : date.getDate()}'
                };
            `
        })).then(() => console.log("Data saved in DynamoDB"));

        // * Customers are notified
        io.emit(topics[2], data);
        console.log("Message sent to clients");
    });

    await connection.subscribe(topics[4], awsMqtt.QoS.AtLeastOnce, async (topic, payload) => {
        const data = JSON.parse(decoder.decode(payload));
        console.log("Received from", topic, data);

        // * Customers are notified
        io.emit(topics[4], data);
        console.log("Message sent to client ok");
    });
};

export { iotCoreServer, socketServer };