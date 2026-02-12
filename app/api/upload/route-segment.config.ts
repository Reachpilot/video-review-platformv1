const config = {
  revalidate: false,
  runtime: 'nodejs',
  dynamic: 'force-dynamic',
  maxDuration: 60,
  preferredRegion: 'auto',
  api: {
    bodyParser: {
      sizeLimit: '110mb',
    },
    responseLimit: false,
  },
};

export default config;
