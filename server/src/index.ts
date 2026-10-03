import { config } from './config.js';
import { app } from './app.js';
import * as jobs from './jobs.js';

app.listen(config.PORT, () => {
  console.log(`server listening on :${config.PORT}`);
  jobs.start();
});
