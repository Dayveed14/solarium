import { Link, useSearchParams } from 'react-router-dom';
import { useAssessment } from '../../components/AssessmentContext.jsx';
import Seo from '../../components/Seo.jsx';
import { WHO_BY_KEY } from '../../lib/guided.js';

export default function SolarLanding() {
  const { open } = useAssessment();
  const [params] = useSearchParams();
  const who = params.get('who');
  const query = WHO_BY_KEY[who] ? `?who=${who}` : '';
  return (
    <div className="wrap page-narrow solar-landing">
      <Seo title="Find a solar solution that fits your needs and budget | TerraVoltix" description="Tell us about your appliances, usage hours, power priorities and budget. TerraVoltix estimates your energy requirements and presents suitable solar system options." />
      <p className="eyebrow">Solar energy</p>
      <h1>Find a solar solution that fits your needs and budget.</h1>
      <p className="lede">Not sure what size solar system you need? Tell us about your appliances, usage hours, power priorities and budget. TerraVoltix will help estimate your energy requirements and present suitable system options to explore.</p>

      <div className="choice-grid solar-ctas">
        <div className="choice choice-static">
          <strong>Enter your budget</strong>
          <span>Answer a few questions about who you power, what for, how long and what matters most. We fit options to what you can spend.</span>
          <Link to={`/assess/solar/guided${query}`} className="btn btn-primary">Enter your budget</Link>
        </div>
        <div className="choice choice-static">
          <strong>Start my solar assessment</strong>
          <span>Prefer to go straight to the calculator? Tick your appliances and we work out the size and the cost.</span>
          <button type="button" className="btn btn-ghost" onClick={() => open({ manual: true, ...(WHO_BY_KEY[who] ? { segment: WHO_BY_KEY[who].segment } : {}) })}>Start my solar assessment</button>
        </div>
      </div>
      <p className="muted"><Link to="/assess">&larr; All energy options</Link></p>
    </div>
  );
}
