# predictions

<https://predictions.atl.dev/>

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (recommended: latest LTS)
- [npm](https://www.npmjs.com/)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (for Cloudflare preview and deployment only)

### Local Development

```sh
npm install
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173) in your browser.

### Environment Setup

1. Copy the environment template and fill it in with your InfluxDB information:

   ```sh
   cp .env.example .env
   ```


### Build for Production

```sh
npm run build
```

### Docker

Build and run the app using Docker:

```sh
docker build -t predictions .
docker run -p 3000:3000 predictions
```

Or use Docker Compose:

```sh
docker-compose up --build
```
