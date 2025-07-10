/**
 * @file Módulo com funções de validação para CPF e CNPJ.
 * As funções foram adaptadas de implementações comuns e validam
 * o formato e os dígitos verificadores.
 */

/**
 * Remove caracteres não numéricos de uma string.
 * @param {string} value - A string para limpar.
 * @returns {string} A string contendo apenas números.
 */
const clean = (value) => {
    return String(value).replace(/[^\d]/g, '');
};

/**
 * Verifica se todos os caracteres de uma string são iguais.
 * @param {string} value - A string para verificar.
 * @returns {boolean} True se todos os caracteres forem iguais, false caso contrário.
 */
const allDigitsAreEqual = (value) => {
    return /^(\d)\1+$/.test(value);
};

/**
 * Valida um número de CNPJ.
 * @param {string | number} cnpj - O CNPJ a ser validado (pode conter máscara).
 * @returns {boolean} True se o CNPJ for válido, false caso contrário.
 */
const isValidCnpj = (cnpj) => {
    const cleanedCnpj = clean(cnpj);

    // Valida o formato (14 dígitos ou 8 para raiz)
    if (cleanedCnpj.length !== 14 && cleanedCnpj.length !== 8) {
        return false;
    }
    
    // Se for um CNPJ raiz (8 dígitos), consideramos válido para a busca.
    if (cleanedCnpj.length === 8) {
        return true;
    }

    // CNPJs com todos os dígitos iguais são inválidos
    if (allDigitsAreEqual(cleanedCnpj)) {
        return false;
    }

    // Cálculo do primeiro dígito verificador
    let size = 12;
    let numbers = cleanedCnpj.substring(0, size);
    let sum = 0;
    let pos = size - 7;
    for (let i = size; i >= 1; i--) {
        sum += parseInt(numbers.charAt(size - i), 10) * pos--;
        if (pos < 2) {
            pos = 9;
        }
    }
    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(cleanedCnpj.charAt(12), 10)) {
        return false;
    }

    // Cálculo do segundo dígito verificador
    size = 13;
    numbers = cleanedCnpj.substring(0, size);
    sum = 0;
    pos = size - 7;
    for (let i = size; i >= 1; i--) {
        sum += parseInt(numbers.charAt(size - i), 10) * pos--;
        if (pos < 2) {
            pos = 9;
        }
    }
    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(cleanedCnpj.charAt(13), 10)) {
        return false;
    }

    return true;
};

/**
 * Valida um número de CPF.
 * @param {string | number} cpf - O CPF a ser validado (pode conter máscara).
 * @returns {boolean} True se o CPF for válido, false caso contrário.
 */
const isValidCpf = (cpf) => {
    const cleanedCpf = clean(cpf);

    if (cleanedCpf.length !== 11 || allDigitsAreEqual(cleanedCpf)) {
        return false;
    }

    let sum = 0;
    let remainder;

    for (let i = 1; i <= 9; i++) {
        sum += parseInt(cleanedCpf.substring(i - 1, i), 10) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) {
        remainder = 0;
    }
    if (remainder !== parseInt(cleanedCpf.substring(9, 10), 10)) {
        return false;
    }

    sum = 0;
    for (let i = 1; i <= 10; i++) {
        sum += parseInt(cleanedCpf.substring(i - 1, i), 10) * (12 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) {
        remainder = 0;
    }
    if (remainder !== parseInt(cleanedCpf.substring(10, 11), 10)) {
        return false;
    }

    return true;
};

// Exporta as funções para serem usadas em outros módulos
module.exports = {
    isValidCnpj,
    isValidCpf,
};
