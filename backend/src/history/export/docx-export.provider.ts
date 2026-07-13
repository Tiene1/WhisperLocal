import { Injectable } from '@nestjs/common';
import { Document, Packer, Paragraph } from 'docx';

/**
 * Infrastructure — génération DOCX à la volée.
 *
 * Règle absolue (CLAUDE.md règle 6) : jamais de fichier `.docx` stocké
 * sur disque ou en base — généré en mémoire à chaque requête d'export,
 * à partir de `resultText` uniquement (librairie JS pure `docx`, aucune
 * dépendance binaire externe — cohérent avec le NFR Portabilité).
 */
@Injectable()
export class DocxExportProvider {
  async generate(text: string, title: string): Promise<Buffer> {
    const paragraphs = text
      .split('\n')
      .map((line) => new Paragraph({ text: line }));

    const document = new Document({
      title,
      sections: [
        {
          properties: {},
          children: paragraphs.length > 0 ? paragraphs : [new Paragraph({ text: '' })],
        },
      ],
    });

    return Packer.toBuffer(document);
  }
}
