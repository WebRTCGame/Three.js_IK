import babel from 'rollup-plugin-babel';
export default {
	input: 'src/Fullik.js',
	
	// sourceMap: true,
	output: [
		{
			format: 'umd',
			name: 'FIK',
			file: 'build/fik.js',
			indent: '\t',
			plugins: [
			  babel({
				exclude: 'node_modules/**'
			  })
			]
		},
		{
			format: 'es',
			file: 'build/fik.module.js',
			indent: '\t',
			plugins: [
			  babel({
				exclude: 'node_modules/**'
			  })
			]
		}
	]
};
