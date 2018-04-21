import * as ChildProcess from 'child_process'

/**
 * Execute the following sh program.
 */
export function execShellScript(body: string): Promise<string> {
  const args = ['-c', body]
  const process = ChildProcess.spawn('bash', args)

  return new Promise((resolve, reject) => {
    let output = ''

    process.stdout.on('data', buffer => {
      output += buffer
    })

    process.on('close', returnCode => {
      if (returnCode === 0) {
        resolve(output)
      } else {
        reject(`Failed to execute ${body}`)
      }
    })
  })
}
