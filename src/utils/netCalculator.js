/**
 * Net hesaplama. Varsayılan formül: Net = Doğru - Yanlış / 3.
 * Farklı bir katsayı gerekirse `wrongPenaltyDivisor` parametresiyle değiştirilebilir.
 */
export function calculateNet(correctCount, wrongCount, wrongPenaltyDivisor = 3) {
  const correct = Number(correctCount) || 0
  const wrong = Number(wrongCount) || 0
  return Math.round((correct - wrong / wrongPenaltyDivisor) * 100) / 100
}
