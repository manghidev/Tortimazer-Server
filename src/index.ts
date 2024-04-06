import env from './config/env.config';

// * Socket.io and AWS IoT Core controller
import { iotCoreServer, socketServer } from './app/controller/iotCore';

// * Run the Socket.io server
socketServer.listen(env.PORT_SOCKET_IO, async () => {
    console.log(`Socket.io server running on port ${env.PORT_SOCKET_IO}`);
    // * Run the AWS IoT Core server
    await iotCoreServer();
});