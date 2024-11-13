# WebXRBabylonIO

1. create a folder called sslcerts in the main folder of the repository
2. open git bash
3. navigate to the main folder
4. create the self-signed certificate and key with the following command:
    openssl req -x509 -sha256 -nodes -days 365 -newkey rsa:2048 -keyout sslcerts/selfsigned.key -out sslcerts/selfsigned.cert
5. npm install
6. node server.js

=> https server should run