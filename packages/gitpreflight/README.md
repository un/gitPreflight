# gitpreflight

Install the GitPreflight CLI globally:

```bash
npm i -g gitpreflight
```

Then run:

```bash
gitpreflight --help
gitpreflight setup
gitpreflight setup local-agent
gitpreflight version
```

`gitpreflight` is a lightweight npm wrapper that downloads and runs the official GitPreflight binary for your platform.

By default, install flow sends a minimal anonymous install event (random install ID + runtime metadata) so we can measure install/activation health. No user identity or repo contents are included. Set `GITPREFLIGHT_ANON_TELEMETRY=0` to disable.

Docs and source:

- https://github.com/un/gitPreflight
