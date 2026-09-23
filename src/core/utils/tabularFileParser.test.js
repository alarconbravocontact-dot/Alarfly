const { parseCsvText } = require('./tabularFileParser');

describe('tabularFileParser.parseCsvText', () => {
  test('separa filas y columnas simples', () => {
    const rows = parseCsvText('Nombre,Correo\nJuan,juan@demo.com\nAna,ana@demo.com');
    expect(rows).toEqual([
      ['Nombre', 'Correo'],
      ['Juan', 'juan@demo.com'],
      ['Ana', 'ana@demo.com'],
    ]);
  });

  test('respeta comas dentro de campos entre comillas', () => {
    const rows = parseCsvText('Nombre,Dirección\n"Café Central, S.A.","Av. Principal, 123"');
    expect(rows).toEqual([
      ['Nombre', 'Dirección'],
      ['Café Central, S.A.', 'Av. Principal, 123'],
    ]);
  });

  test('resuelve comillas escapadas ("") dentro de un campo entre comillas', () => {
    const rows = parseCsvText('Nota\n"Dijo ""hola"" al entrar"');
    expect(rows).toEqual([['Nota'], ['Dijo "hola" al entrar']]);
  });

  test('maneja saltos de línea con \\r\\n igual que con \\n', () => {
    const rows = parseCsvText('A,B\r\n1,2\r\n3,4');
    expect(rows).toEqual([
      ['A', 'B'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });
});
