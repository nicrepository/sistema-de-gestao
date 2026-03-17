/**
 * Formata o texto para Upper Case (Título).
 */
export const toUpperCase = (text: string): string => {
  return text.toUpperCase();
};

/**
 * Formata o texto para Sentence Case (Primeira letra maiúscula e após pontuação).
 */
export const toSentenceCase = (text: string): string => {
  if (!text) return '';
  
  // Converte a primeira letra para maiúscula
  let formatted = text.charAt(0).toUpperCase() + text.slice(1);
  
  // Converte a letra após pontuação (. ! ?) para maiúscula
  formatted = formatted.replace(/([.!?]\s+)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());
  
  return formatted;
};

/**
 * Limpeza semi-automática de texto:
 * - Remove espaços duplos
 * - Garante espaço após vírgulas e pontos
 * - Remove espaços antes de vírgulas e pontos
 */
export const cleanText = (text: string): string => {
  if (!text) return '';
  
  let cleaned = text;
  
  // Remove espaços duplos
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  
  // Garante que não haja espaço antes de vírgula, ponto, ponto e vírgula, dois pontos, exclamação, interrogação
  cleaned = cleaned.replace(/\s+([,.!;?])/g, '$1');
  
  // Garante que haja um espaço após vírgula, ponto, etc. se houver um caractere alfanumérico depois
  cleaned = cleaned.replace(/([,.!;?])([a-zA-Z0-9áéíóúâêîôûàèìòùãõç])/g, '$1 $2');
  
  return cleaned;
};
