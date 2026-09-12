#!/usr/bin/env node
import { main } from '../src/index.js';

main(process.argv.slice(2)).catch((err) => {
    console.error(`\n✖ ${err.message}`);
    if (process.env.COLLAB_DEBUG) console.error(err.stack);
    process.exit(1);
});