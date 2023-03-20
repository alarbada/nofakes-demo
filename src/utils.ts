// This little helper function will help us with exhaustiveness type checking
export function assertNever(x: never): never {
    throw new Error('Unexpected object: ' + x)
}
