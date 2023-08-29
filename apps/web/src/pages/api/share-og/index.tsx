import { ImageResponse, NextRequest } from 'next/server';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const signature = searchParams.get('signature') || 'Timur';

  const [imageData, CaveatFontData, InterFontData] = await Promise.all([
    fetch(new URL('../../../assets/background-pattern-og.png', import.meta.url)).then((res) =>
      res.arrayBuffer(),
    ),
    fetch(new URL('../../../assets/Caveat-Regular.ttf', import.meta.url)).then((res) =>
      res.arrayBuffer(),
    ),
    fetch(new URL('../../../assets/Inter-Regular.ttf', import.meta.url)).then((res) =>
      res.arrayBuffer(),
    ),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: `url('data:image/png;base64,${Buffer.from(
            imageData as unknown as string,
          ).toString('base64')}')`,
          backgroundSize: '1200px 630px',
          backgroundPositionY: '0%',
        }}
      >
        <div tw="flex px-20 py-12 bg-gray-100 rounded-md border-solid border-4 border-zinc-200 shadow-md">
          <div tw="text-[#64748B99] text-7xl">{signature}</div>
        </div>
        <div tw="text-black text-3xl my-8 text-gray-600" style={{ fontFamily: 'Inter' }}>
          You signed with Documenso
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Caveat',
          data: CaveatFontData,
          style: 'italic',
        },
        {
          name: 'Inter',
          data: InterFontData,
          style: 'normal',
        },
      ],
    },
  );
}
