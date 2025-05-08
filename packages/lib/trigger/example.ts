import { task } from '@trigger.dev/sdk/v3';
import fs from 'fs/promises';
// Usa la versión asíncrona
import fetch from 'node-fetch';
// Asegúrate de instalarlo con `pnpm add node-fetch`
import * as path from 'node:path';

import { prisma } from '@documenso/prisma';

import { extractText } from '../services/textparser';

const __dirname = path.dirname(__filename);
const filename = __filename;
const downloadsDir = path.join(__dirname, 'downloads');

// 🔹 Crear la carpeta de descargas si no existe
export async function ensureDownloadDir() {
  try {
    await fs.mkdir(downloadsDir, { recursive: true });
  } catch (error) {
    console.error('❌ Error creando la carpeta de descargas:', error);
  }
}

// export const getFileAndAnalyze = async (fileId: number, workspaceId:string) => {
//   if (!fileId) {
//     return null;
//   }
//   const { id } = await helloWorldTask.trigger({
//     fileId: fileId, workspaceId: workspaceId
//   });
//   return id;
// };

interface TemplateField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'number' | 'currency';
  placeholder?: string;
  required: boolean;
}

export const extractBodyContractTask = task({
  id: 'extract-body-contract',
  // Set an optional maxDuration to prevent tasks from running indefinitely
  // Stop executing after 300 secs (5 mins) of compute
  run: async (payload: { pdfUrls: string[]; id: number; workspace: number; name: string }) => {
    const decryptedId = payload.workspace;
    console.log(`🔹 Workspace ID: ${decryptedId} y ${payload.workspace}`);
    if (!decryptedId) {
      console.log(`⚠️ No se pudo desencriptar el ID: ${payload.workspace}`);
      return null;
    }

    console.log(`🔹 Procesando ${payload.pdfUrls.length} URLs de PDF`);

    const results = [];

    for (const pdfUrl of payload.pdfUrls) {
      try {
        console.log(`🔹 Descargando PDF desde: ${pdfUrl}`);

        const response = await fetch(pdfUrl);

        if (!response.ok) {
          throw new Error(`Error al obtener ${pdfUrl}, código HTTP: ${response.status}`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        console.log(`✅ PDF descargado con éxito, tamaño: ${buffer.length} bytes`);

        const fileName = payload.name;

        const extractedText = await extractText(fileName ?? 'archivo_desconocido', buffer, pdfUrl);
        if (!extractedText) {
          console.log(`⚠️ No se pudo extraer el texto del PDF: ${fileName}`);
          await prisma.contractTemplate.update({
            where: { id: payload.id },
            data: { status: 'Error' },
          });
          return;
        }

        if (extractedText === 'Error al procesar el PDF.') {
          console.log(`⚠️ No se pudo extraer el texto del PDF: ${fileName}`);
          await prisma.contractTemplate.update({
            where: { id: payload.id },
            data: { status: 'Error' },
          });
          return;
        }

        console.log(`✅ texto extraido con éxito`);
        console.log('extractedText', extractedText);

        if (extractedText) {
          await prisma.contractTemplate.update({
            where: { id: payload.id },
            data: { status: 'Completado', body: extractedText },
          });
        }
      } catch (error) {
        console.log(`⚠️ Error al procesar el PDF en ${pdfUrl}:`, error);
        await prisma.contractTemplate.update({
          where: { id: payload.id },
          data: { status: 'Error' },
        });
        // Agregar el error al array de resultados
        results.push({
          success: false,
          url: pdfUrl,
          error: error || `Error al procesar el PDF`,
        });
      }
    }
  },
});

// export const helloWorldTask = task({
//   id: "hello-world",
//   // Set an optional maxDuration to prevent tasks from running indefinitely
//   // Stop executing after 300 secs (5 mins) of compute
//   run: async (payload: { fileId: number, workspaceId: string }) => {

//     console.log(`🔹 Buscando archivo con ID: ${payload.fileId} en la base de datos...`);
//   const decryptedId = await decryptId(payload.workspaceId);
//   console.log(`🔹 Workspace ID: ${decryptedId} y ${payload.workspaceId}`);
//   if (!decryptedId) {
//     console.log(`⚠️ No se pudo desencriptar el ID: ${payload.workspaceId}`);
//     return null;
//   }

//   console.log(`🔹 Workspace ID: ${decryptedId}`);

//   // Obtener el archivo desde la base de datos
//   const file = await db
//     .select()
//     .from(files)
//     .where(eq(files.id, payload.fileId))
//     .then((res) => res[0]);

//   if (!file) {
//     console.log(`⚠️ No se encontró un archivo con ID: ${payload.fileId}`);
//     return null;
//   }
//   if (!file.url) {
//     console.log(`⚠️ El archivo ${file.name || "desconocido"} no tiene URL, se omite.`);
//     return null;
//   }

//     const report =  await createReport({name: file.name,
//       body: "Procesando archivo...",
//       workspacesId: Number(decryptedId),
//       status:"En proceso"
//     });

//     if(!report){
//       console.log(`⚠️ No se pudo crear el reporte para el archivo con ID: ${payload.fileId}`);
//       return null;
//     }

//   try {
//     console.log(`📥 Descargando archivo: ${file.url}`);
//     const response = await fetch(file.url);

//     if (!response.ok) {
//       throw new Error(`Error al obtener ${file.url}, código HTTP: ${response.status}`);
//     }

//     const buffer = Buffer.from(await response.arrayBuffer());
//     message:`✅ Archivo ${file.name} descargado con éxito.`;

//     // Asegurar que la carpeta 'downloads' existe
//     await ensureDownloadDir();

//     // Guardar el archivo localmente
//     const tempPath = path.join(downloadsDir, file.name ?? "archivo_desconocido");
//     await fs.writeFile(tempPath, buffer);
//     message:`📂 Archivo guardado temporalmente en: ${tempPath}`;

//     const extractedText = await extractText(file.name ?? "archivo_desconocido", buffer, file.url);
//     if (!extractedText) {
//       console.log(`⚠️ No se pudo extraer el texto del archivo: ${file.name}`);
//       await db.update(reports)
//         .set({ body: "No se pudo extraer el texto", status: "Error" })
//         .where(eq(reports.id, report.id));
//       return null;
//     }
//     // Generar resumen con IA
//     const summary = await summarizeText(extractedText);
//     message: `📄 Resumen generado para ${file.name}:`;

//     // Insertar resumen en la base de datos
//     await db.update(reports)
//       .set({ body: summary, status: "Completado" })
//       .where(eq(reports.id, report.id));

//     message: summary;

//     return {
//       fileId: payload.fileId,
//       fileName: file.name,
//       summary,
//     };
//   } catch (error) {
//     message:`❌ Error procesando ${file.url}:`;
//       await db.update(reports)
//       .set({ body: "No fue posible crear el reporte", status: "Error" })
//       .where(eq(reports.id, report.id));
//     return null;
//   }

//   },
// });
