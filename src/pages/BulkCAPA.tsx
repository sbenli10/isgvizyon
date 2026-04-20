import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, Alignment, Media } from 'docx';

const generateDofReport = (analyses) => {
    const doc = new Document();

    analyses.forEach((analysis, analysisIndex) => {
        const paragraphs = [];
        const photos = analysis.photos;
        if (photos && photos.length > 0) {
            let tableRows = [];

            for (let i = 0; i < photos.length; i += 3) {
                const rowCells = []; // Cells for current row
                const endIndex = Math.min(i + 3, photos.length);
                for (let j = i; j < endIndex; j++) {
                    const photo = photos[j];
                    const cell = new TableCell({
                        children: [
                            Media.addImage(doc, photo.file),
                            new Paragraph({ text: `Madde ${analysisIndex + 1} - Fotoğraf ${j + 1}/${photos.length}`, alignment: Alignment.CENTER }),
                        ],
                        borders: { top: { style: 'none' }, bottom: { style: 'none' }, left: { style: 'none' }, right: { style: 'none' } },
                    });
                    rowCells.push(cell);
                }
                tableRows.push(new TableRow({ children: rowCells }));
            }

            const table = new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } });
            paragraphs.push(table);
        }

        doc.addSection({ children: [...paragraphs] });
    });

    Packer.toBuffer(doc).then((buffer) => {
        // Save or process the .docx file buffer
    });
};

export default generateDofReport;