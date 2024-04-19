import { registerUniformComponent, ComponentProps, UniformText } from '@uniformdev/canvas-react';

type HeroProps = ComponentProps<{
  title: string;
  description?: string;
}>;

const Hero: React.FC<HeroProps> = () => (
  <div>
    <UniformText className="title" parameterId="title" as="h1" placeholder="hero title goes here" />
    <UniformText className="description" parameterId="description" placeholder="hero description goes here" />
  </div>
);

export default Hero;

registerUniformComponent({
  type: 'hero',
  component: Hero,
});
