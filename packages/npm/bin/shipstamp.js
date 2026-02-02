#!/usr/bin/env bun

"use strict";

const { runCli } = require("@shipstamp/cli");

Promise.resolve(runCli(process.argv.slice(2)))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    process.stderr.write(`Shipstamp internal error: ${err?.message ?? String(err)}\n`);
    process.exitCode = 2;
  });
