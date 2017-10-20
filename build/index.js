const stiks = require('stiks');
const log = stiks.log;
const argv = stiks.argv;
const colurs = stiks.colurs.get();
const chek = stiks.chek;
const exec = stiks.exec;
const pkg = stiks.pkg();
const build = pkg && pkg.build;

// Ensure build info.
if (!build)
  log.error('whoops looks like you forgot to configure package.json "build".').exit();

// Parse command line arguments.
const parsed = argv.parse();
const cmdOpts = argv.options;
let cmd, opts;

/**
 * Normalize
 * Normalizes the command arguments.
 *
 * @param {string|array} cmds
 * @param {string|array} options
 */
function normalize(cmds, options) {
  options = options || argv.options;
  if (chek.isString(cmds))
    cmds = cmds.split(' ');
  if (chek.isString(options))
    options = options.split(' ');
  const output = cmds;
  // Ensure we don't append dupes.
  options.forEach((o) => {
    if (!chek.contains(output, o))
      output.push(o);
  });
  return output;
}

// Build actions.
const actions = {

  clean: () => {
    stiks.clean(build.clean);
    return actions;
  },

  copy: () => {
    stiks.copy(build.copy);
    return actions;
  },

  compile: (watch) => {
    opts = '-p ./src/tsconfig.json'
    opts += (watch ? '-w' : '');
    cmd = normalize('./node_modules/typescript/bin/tsc', opts);
    exec.node(cmd);
    return actions;
  },

  watch: () => {
    actions.compile(true);
  },

  docs: () => {
    opts = '--out ./docs ./src --options ./typedoc.json';
    cmd = normalize('./node_modules/typedoc/bin/typedoc', opts);
    exec.node(cmd);
    return actions;
  },

  bump: () => {
    stiks.bump();
    return actions;
  },

  build: () => {
    actions.clean()
      .copy()
      .compile();
    return actions;
  },

  commit: () => {
    if (!/-[a-zA-Z]{0,7}?m/g.test(cmdOpts.join(' ')))
      opts = ['-am', '"auto commit"'];
    cmd = normalize('commit', opts);
    exec.command('git', 'add .');
    exec.command('git', cmd);
    exec.command('git', 'push');
    return actions;
  },

  publish() {
    exec.npm('publish');
    return actions;
  },

  release: () => {
    actions
      .build()
      .docs()
      .bump()
      .commit()
      .publish();
    return actions;
  },

  test: () => {
    exec.command('nyc', 'mocha --opts ./src/mocha.opts');
  },

  exit: (msg) => {
    if (msg)
      log.write(msg).exit();
    process.exit(0);
  }

};

if (!actions[parsed.cmd])
  log.error(new Error(`Failed to run command ${parsed.cmd}, the command does not exist.`)).exit();

// Start the chain.
actions[parsed.cmd]();