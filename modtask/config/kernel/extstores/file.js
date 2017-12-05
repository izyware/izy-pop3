
var modtask = 
{
	externalPathResolver : function(modtask) 
	{
		var currentdir = 'rel:/';
		try { 
			currentdir = process.cwd() + '/';
		} catch(e) { } 
		return [
			currentdir,
			currentdir + 'node_modules/',
			currentdir + 'node_modules/izymodtask/',
			currentdir + '../',
			'rel:/',
			'rel:/../thirdparty/',
			'rel:/../../'
		];			
	} 
}


