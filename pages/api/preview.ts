import { NextApiHandler } from 'next';
import { previewHandler } from './previewHandler';

const handler: NextApiHandler = async (req, res) => {
  const method = req.method?.toLocaleLowerCase();
  const secret = () => process.env.UNIFORM_PREVIEW_SECRET;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD');

  if (method === 'get') {
    previewHandler({ secret, resolveFullPath: undefined, playgroundPath: undefined })(req, res);
    return;
  } else if (method === 'options') {
    res.status(204).end();
    return;
  }

  res.status(501).json({ message: `Method "${method}" not implemented` });
  return;
};

export default handler;
