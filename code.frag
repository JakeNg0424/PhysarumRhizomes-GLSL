#define INPUTS sTD2DInputs
#define OUTPUTS mTDComputeOutputs
#define STEERING_COEF 0.5

uniform float speed;
uniform vec2 domainSize;
uniform float weight;
uniform float sense_angle;
uniform float sense_distance;

vec2 angleToDir(const float angle)
{
    return vec2(cos(angle), sin(angle));
}

ivec2 getAgentAddress(const vec2 agent_pos, const vec2 output_resolution)
{
    return ivec2(output_resolution * agent_pos / domainSize);
}

vec2 getAgentRelpos(const vec2 agent_pos)
{
    return vec2(agent_pos / domainSize);
}

layout(local_size_x = 16, local_size_y = 16) in;
void main()
{
    // Get agent data, formatted as [pos_x, pos_y, angle, <void>]
    vec2 out_resolution = uTDOutputInfo.res.zw;
    vec4 agent_data = texelFetch(INPUTS[0], ivec2(gl_GlobalInvocationID.xy), 0);
    vec2 agent_pos = agent_data.xy;
    float agent_angle = agent_data.z;

    // Sense environment forward, left and right
    vec2 pos_fwd = mod(agent_pos + sense_distance * angleToDir(agent_angle), domainSize);
    float density_fwd = texture(INPUTS[1], getAgentRelpos(pos_fwd)).r;

    vec2 pos_left = mod(agent_pos + sense_distance * angleToDir(agent_angle + radians(sense_angle)), domainSize);
    float density_left = texture(INPUTS[1], getAgentRelpos(pos_left)).r;

    vec2 pos_right = mod(agent_pos + sense_distance * angleToDir(agent_angle - radians(sense_angle)), domainSize);
    float density_right = texture(INPUTS[1], getAgentRelpos(pos_right)).r;

    // Steer towards the highest marker density
    if (density_left > density_fwd && density_left > density_right)
        agent_angle += STEERING_COEF * sense_angle;
    else if (density_right > density_fwd && density_right > density_left)
        agent_angle -= STEERING_COEF * sense_angle;

    // Update agent direction and position
    vec2 agent_dir = angleToDir(agent_angle);
    agent_pos += speed * agent_dir;
    agent_pos = mod(agent_pos, domainSize);

    // Update agent data in pos/dir buffer
    agent_data = vec4(agent_pos, agent_angle, 0.0);
    imageStore(OUTPUTS[0], ivec2(gl_GlobalInvocationID.xy), TDOutputSwizzle(agent_data));

    // Accumulate agent's density contribution
    ivec2 agent_address = getAgentAddress(agent_pos, out_resolution);
    float current_density = weight + texelFetch(INPUTS[1], agent_address, 0).r;
    imageStore(OUTPUTS[1], agent_address, TDOutputSwizzle(vec4(current_density, current_density, 0.0, 1.0)));
}
