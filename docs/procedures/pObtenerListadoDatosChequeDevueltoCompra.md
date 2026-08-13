# SP: pObtenerListadoDatosChequeDevueltoCompra
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saChequeDevueltoCompra`](../tables/saChequeDevueltoCompra.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerListadoDatosChequeDevueltoCompra]
DESCRIPCION: Obtiene la lista de documentos segun los parametros de entrada
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerListadoDatosChequeDevueltoCompra]
    (
      @sDatabase_Name				VARCHAR(30)			= NULL,
     
      @sField_Name					VARCHAR(30)			= NULL,
   
      @sValor						VARCHAR(30)			= NULL,
       
      @bAvanzada					BIT					= NULL,
      @bUsaOperadorLogicoAND		BIT					= NULL,

	  @bAplica_Estatus				BIT					= NULL,
      @sEstatus						CHAR(1)				= NULL,
      
      @bAplica_Fecha				BIT					= NULL,
      @dFecha_Desde					SMALLDATETIME		= NULL,
      @dFecha_Hasta					SMALLDATETIME		= NULL,

	  @bAplica_Proveedor			BIT					= NULL,
	  @sCo_Prov						CHAR(16)			= NULL,

	  @bAplica_Cheque				BIT					= NULL,
	  @sCheque						CHAR(20)			= NULL,          
      
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
					   FROM ' + CONVERT(NVARCHAR(100), 'saChequeDevueltoCompra') + ' WHERE '
		
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
					BEGIN
						SET @SqlString = @SqlString + CONVERT(NVARCHAR(100), @sField_Name) + N' LIKE ''%'
							+ @sValor + '%'''
					END
			
				IF ( @iOpcion = 3 )--Es Igual
					BEGIN
						SET @SqlString = @SqlString + CONVERT(NVARCHAR(100), @sField_Name) + N' = '''
							+ CONVERT(NVARCHAR(30), @sValor) + ''''
					END
			
				IF ( @iOpcion = 4 )--Fonetica
					BEGIN
						SET @SqlString = @SqlString + N' dbo.SoundexBusqueda(' + CONVERT(NVARCHAR(10
```
