import Footer from '@/components/Footer';
import '../components';
import { UniformComposition, UniformSlot } from '@uniformdev/canvas-react';
import { RouteClient } from '@uniformdev/canvas';

const Page = ({ composition }) => {
  return (
    <main className="main">
      <UniformComposition data={composition}>
        <UniformSlot name="content" />
      </UniformComposition>
      <Footer />
    </main>
  );
};

export const getServerSideProps = async context => {
  const { slug } = context.params || {};
  const path = slug ? `/${slug.join('/')}` : '/';

  // Fetch data from Uniform Route API
  const routeClient = new RouteClient({
    apiKey: process.env.UNIFORM_API_KEY,
    projectId: process.env.UNIFORM_PROJECT_ID,
  });

  const response = await routeClient.getRoute({ path });
  if (response.type !== 'composition') {
    return { notFound: true };
  }

  const { composition } = response?.compositionApiResponse || {};
  return { props: { composition } };
};

export default Page;
