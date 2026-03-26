
import { io } from 'socket.io-client';

const URL = 'http://localhost:3000'; // Make this environmental later
const socket = io(URL, {
    autoConnect: false
});

export default socket;
