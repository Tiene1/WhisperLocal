import { DocxExportProvider } from './docx-export.provider';

describe('DocxExportProvider', () => {
  let provider: DocxExportProvider;

  beforeEach(() => {
    provider = new DocxExportProvider();
  });

  it('génère un buffer .docx non vide à partir du texte fourni', async () => {
    const buffer = await provider.generate('Bonjour\nle monde', 'transcription');

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    // Signature ZIP (un .docx est une archive ZIP OOXML)
    expect(buffer.subarray(0, 2).toString('hex')).toBe('504b');
  });

  it('gère un texte vide sans lever d\'erreur (paragraphe vide de repli)', async () => {
    const buffer = await provider.generate('', 'transcription-vide');

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('ne persiste jamais rien sur disque — retourne uniquement un Buffer en mémoire', async () => {
    const writeFileSpy = jest.spyOn(require('fs/promises'), 'writeFile');

    await provider.generate('Contenu de test', 'rapport');

    expect(writeFileSpy).not.toHaveBeenCalled();
    writeFileSpy.mockRestore();
  });
});
