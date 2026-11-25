// Preloaded into every test run by fixture.mjs: code under test may not end the run early with a passing exit.
const realExit = process.exit.bind(process);
process.exit = code => {
  if (code === 0 || code === undefined) throw new Error('process.exit(0) called during a test run');
  realExit(code);
};
