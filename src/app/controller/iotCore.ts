import express from 'express';
const app = express();
import { createServer } from 'http';
const socketServer = createServer(app);
import { Server } from 'socket.io';
const io = new Server(socketServer, {
    cors: {
        origin: '*',
    },
});

import path from 'path';
import iot_sdk from 'aws-iot-device-sdk-v2';
const mqtt = iot_sdk.mqtt
import { TextDecoder } from 'util';
import aws_crt from 'aws-crt';
const iot = aws_crt.iot;
const mqtt_crt = aws_crt.mqtt;

const iotCoreServer = async () => {
    const decoder = new TextDecoder('utf-8');

    const topics = [
        'client_to_server',
        'board_to_server',
        'server_to_clients',
        'server_to_boards'
    ];

    const certificate = path.join(__dirname, '/../keys', 'cert.pem');
    const privateKey = path.join(__dirname, '/../keys', 'private.key');
    const rootCA = path.join(__dirname, '/../keys', 'root-CA.crt');
    const clientID = '{clientID}';
    const endPoint = '{code}-ats.iot.{region}.amazonaws.com';

    const config_builder = iot.AwsIotMqttConnectionConfigBuilder.new_mtls_builder_from_path(certificate, privateKey);

    config_builder.with_certificate_authority_from_path(undefined, rootCA);

    config_builder.with_clean_session(false);
    config_builder.with_client_id(clientID);
    config_builder.with_endpoint(endPoint);

    const connection = new mqtt_crt.MqttClient().new_connection(config_builder.build());

    await connection.connect().catch((error) => console.log("Connect error: " + error));

    // * Método para escuchar las conexiones de los clientes
    io.on('connection', (socket) => {
        console.log(`User connected with id: ${socket.id}`);

        // * Método para escuchar los mensajes de los clientes
        socket.on(topics[0], async (message) => {
            console.log("Received from client", message);

            // * Se notifica a las tablillas
            await connection.publish(topics[3], message, mqtt.QoS.AtLeastOnce);
            console.log("Message sent to boards");
        });
    });

    // * Método para escuchar los mensajes de las tablillas
    await connection.subscribe(topics[1], mqtt.QoS.AtLeastOnce, async (topic, payload) => {
        const data = JSON.parse(decoder.decode(payload));
        console.log("Received from board", topic, data);

        // * Se notifica a los clientes
        io.emit(topics[2], data);
        console.log("Message sent to clients");
    });
};

export { iotCoreServer };