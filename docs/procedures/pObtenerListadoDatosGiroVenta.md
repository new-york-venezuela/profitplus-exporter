# SP: pObtenerListadoDatosGiroVenta
**Tipo**: Obtener
**Módulo**: Ventas

## Tablas Referenciadas
- [`saGiroVenta`](../tables/saGiroVenta.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerListadoDatosGiroVenta]
DESCRIPCION: Obtiene la lista de documentos segun los parametros de entrada
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerListadoDatosGiroVenta]
    (
      @sDatabase_Name				VARCHAR(30)			= NULL,
     
      @sField_Name					VARCHAR(30)			= NULL,
   
      @sValor						VARCHAR(30)			= NULL,
       
      @bAvanzada					BIT					= NULL,
      @bUsaOperadorLogicoAND		BIT					= NULL,

	  @bAplica_Cobro				BIT					= NULL,
      @sCob_Num						CHAR(20)			= NULL,
      
      @bAplica_Fecha				BIT					= NULL,
      @dFecha_Desde					SMALLDATETIME		= NULL,
      @dFecha_Hasta					SMALLDATETIME		= NULL,

	  @bAplica_Cliente				BIT					= NULL,
	  @sCo_Cli						CHAR(16)			= NULL,

	  @bAplica_Vendedor				BIT					= NULL,
	  @sCo_Ven						CHAR(6)				= NULL,
	  
	  @bAplica_CantGiro				BIT					= NULL,
	  @iCant_Giro					INT					= NULL,
	  
	  @bAplica_Fecha_P_Giro			BIT					= NULL,
      @dFecha_P_Giro_Desde			SMALLDATETIME		= NULL,
      @dFecha_P_Giro_Hasta			SMALLDATETIME		= NULL,
	  
	  @bAplica_PorcInteres			BIT					= NULL,
	  @dPorc_Interes				DECIMAL(18,2)		= NULL,
	  
	  @bAplica_Frecuencia			BIT					= NULL,
	  @sFrecuencia					CHAR(2)				= NULL,
	  
	  @bAplica_Estatus				BIT					= NULL,
	  @sEstatus						CHAR(1)				= NULL,          
      
      @iOpcion						INT					= NULL
    )
AS 
    BEGIN	
        DECLARE @SqlString		NVARCHAR(MAX)
        DECLARE @operadorLogico CHAR(4)
        
        IF (@bUsaOperadorLogicoAND = 1)
			SET @operadorLogico = ' AND'
		ELSE 
			SET @operadorLogico = ' OR'
			
          SET @SqlString = N'USE ' + CONVERT(NVARCHAR(100), @sDataBase_Name) + ' SELECT TOP(500) *    
					   FROM ' + CONVERT(NVARCHAR(100), 'saGiroVenta') + ' WHERE '
		
		IF (@sValor <> '')
			BEGIN
				IF ( @iOpcion = 0 )--Inicia en
					BEGIN
						SET @SqlString = @SqlString + CONVERT(NVARCHAR(100), @sField_Name) + N' LIKE '''
							+ CONVERT(NVARCHAR(30), @sValor) + '%'''
					END

				IF ( @iOpcion = 1 )--Termina en
					BEGIN
						SET @SqlString = @SqlString + CONVERT(NVARCHAR(100), @sField_Name) + N' LIKE ''%'
							+ CONVERT(NVARCHAR(30), @sValor) + ''''
					END

				IF ( @iOpcion = 2 )--Contiene
```
