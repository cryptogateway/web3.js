/*
    This file is part of web3.js.

    web3.js is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    web3.js is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with web3.js.  If not, see <http://www.gnu.org/licenses/>.
*/
/**
 * @file index.js
 * @authors: Samuel Furter <samuel@ethereum.org>
 * @date 2018
 */

import oboe from 'oboe';
import AbstractSocketProvider from '../../lib/providers/AbstractSocketProvider';
import JsonRpcMapper from '../mappers/JsonRpcMapper';

export default class IpcProvider extends AbstractSocketProvider {
    /**
     * TODO: Add timeout to constructor
     *
     * @param {String} path
     * @param {Net} net
     *
     * @constructor
     */
    constructor(path, net) {
        super(net.connect({path: path}), null);
        this.net = net;
    }

    /**
     * Registers all the required listeners.
     *
     * @method registerEventListeners
     */
    registerEventListeners() {
        if (this.net.constructor.name === 'Socket') {
            oboe(this.connection).done(this.onMessage);
        } else {
            this.connection.addListener('data', message =>  {
                this.onMessage(message.toString());
            });
        }

        this.connection.addListener('connect', this.onConnect);
        this.connection.addListener('error', this.onError);
        this.connection.addListener('close', this.onClose);
        this.connection.addListener('ready', this.onOpen);
    }

    /**
     * Removes all listeners on the EventEmitter and the socket object.
     *
     * @method removeAllListeners
     *
     * @param {String} event
     */
    removeAllListeners(event) {
        this.connection.removeAllListeners(event);
        super.removeAllListeners(event);
    }

    /**
     * Will close the socket connection.
     *
     * @method disconnect
     */
    disconnect() {
        this.connection.destroy();
    }

    /**
     * Returns true if the socket connection state is OPEN
     *
     * @property connected
     *
     * @returns {Boolean}
     */
    get connected() {
        return !this.connection.pending;
    }

    /**
     * Try to reconnect
     *
     * @method reconnect
     */
    reconnect() {
        this.connection.connect({path: this.path});
    }

    /**
     * Sends the JSON-RPC request
     *
     * @method send
     *
     * @param {String} method
     * @param {Array} parameters
     *
     * @returns {Promise<any>}
     */
    send(method, parameters) {
        return new Promise((resolve, reject) => {
            if (this.connection.pending) {
                reject(new Error('Connection error: The socket is still trying to connect'));
            }

            // try reconnect, when connection is gone
            if (!this.connection.writable) {
                this.connection.connect({path: this.path});
            }

            const payload = JsonRpcMapper.toPayload(method, parameters);

            if (this.connection.write(JSON.stringify(payload))) {
                this.on(payload.id, response => {
                    this.removeAllListeners(payload.id);

                    return resolve(response);
                });

                return;
            }

            return reject(new Error('Connection error: Couldn\'t write on the socket with Socket.write(payload)'));
        });
    }
}
