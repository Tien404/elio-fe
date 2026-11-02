export function sumQuizPoints(values: number[]) {
  return Number(values.reduce((total, value) => total + value, 0).toPrecision(15))
}
