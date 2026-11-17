export function errorMessage(error: unknown) {
  if (error instanceof TypeError || (error instanceof DOMException && error.name === 'TimeoutError')) {
    return 'Нет ответа от сервера. Проверьте соединение и попробуйте ещё раз.';
  }
  return error instanceof Error ? error.message : 'Не удалось выполнить запрос. Попробуйте ещё раз.';
}
