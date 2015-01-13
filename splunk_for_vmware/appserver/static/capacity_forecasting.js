require(['jquery', 'underscore', 'splunkjs/mvc', 'splunkjs/mvc/tokenawaremodel', 'splunkjs/mvc/simplexml/ready!'],
    function ($, _, mvc, TokenAwareModel) {
		
        /*------ Token Handling ------*/
        var submittedTokens = mvc.Components.get('submitted');
        submittedTokens.on('change:timeMultiplier', _.debounce(function () {
        if (submittedTokens.has('timeMultiplier') && submittedTokens.get('timeMultiplier') !== null) {
        		var timeMult = submittedTokens.get('timeMultiplier');               
                if (submittedTokens.has('timeSpan') && submittedTokens.get('timeSpan') !== "") {
                	var number = submittedTokens.get('timeSpan');
                    submittedTokens.set('futuretimeSpan', Math.ceil(number * timeMult));
                }                
            } 
        }));
        submittedTokens.on('change:timeSpan', _.debounce(function () {
            if (submittedTokens.has('timeSpan') && submittedTokens.get('timeSpan') !== "") {
                var number = submittedTokens.get('timeSpan');
            } else {
                alert('Please enter a value for Prediction Time!');
                return;
            }
            if (submittedTokens.has('timeMultiplier') && submittedTokens.get('timeMultiplier') !== null) {
                var timeMult = submittedTokens.get('timeMultiplier');
                submittedTokens.set('futuretimeSpan', Math.ceil(number * timeMult));
            }

        }));
    });