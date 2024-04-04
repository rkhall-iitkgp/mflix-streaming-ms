# Movie Search Microservice

This is a Node.js microservice built to provide streaming functionality for a movie database. It utilizes MongoDB and Amazon S3 for data storage.

## Features
- Video Upload - 320p, 480p, 720p, 1080p
- Video Streaming - Auto, 320p, 480p, 720p, 1080p
- Party Watch - Synchronous Video Streaming and Live Chat

## Installation

1. Clone the repository:

```bash
git clone https://github.com/{GITHUB_ID}/mflix-streaming-ms.git
```

2. Install dependencies:
```bash
npm install -g pnpm
pnpm install
```

3. Set up environment variables:

Create a .env file in the root directory of the project and populate it with the following variables:

```makefile
FRONTEND_URL="" # The URL of the frontend application.
PORT=5000 # The port number on which the microservice will run.
MONGO_URI = # URI for connecting to MongoDB.
NODE_TLS_REJECT_UNAUTHORIZED = 0 # Set to 0 to disable SSL certificate validation (not recommended for production).
DEPLOYMENT=local # Specifies the deployment environment (e.g., local, production).
AWS_ACCESS_ID= # for accessing s3
AWS_SECRET_ACCESS_KEY= # for accessing s3
```

### Usage
Once the installation and environment variables setup is complete, start the microservice:

```bash
pnpm start
```
