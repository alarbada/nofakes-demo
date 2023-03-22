# nofakes-demo

Here the source code for the backend challenge of nofakes.

Most commits have a concise explanation, so if you want to know how I thought every code change please look at the commit descriptions.

# Requirements

- This project was developed using nodejs 18. I cannot guarantee that it works as expected for prior versions
- docker + docker-compose, latest versions preferred.

# Getting started

1. Install all dependencies:

`$ npm install`

2. Rename the `example.env` to `.env`. Feel free to fill with your own custom configuration

3. Startup the mongodb dev instance

`$ docker-compose up -d`

4. Run esbuild scripts on watch mode

`$ npm run dev`

5. Start the dev server on `http://localhost:$SERVER_PORT`

`$ npm run start`
or 
`$ npm start`

# Other useful scripts

- To run the tests, just use:

`$ npm run test`
or
`$ npm test`

- These are for code quality

format code with prettier
`$ npm run prettify`

lint code with eslint
`$ npm run lint`
