import { ImageResponse } from 'next/server';

export const config = {
  runtime: 'edge',
};

export async function GET() {
  const [imageData, fontData] = await Promise.all([
    fetch(new URL('../../../../assets/background-pattern.png', import.meta.url)).then((res) =>
      res.arrayBuffer(),
    ),
    fetch(new URL('../../../assets/Caveat-Regular.ttf', import.meta.url)).then((res) =>
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
          backgroundSize: '1200px 850px',
          backgroundPositionY: '0%',
        }}
      >
        <div tw="p-16 border-solid border-2 border-sky-500">
          <div tw=" text-[#64748B99]">Duncan</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Caveat',
          data: fontData,
          style: 'italic',
        },
      ],
    },
  );
}
