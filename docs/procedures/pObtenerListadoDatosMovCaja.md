# SP: pObtenerListadoDatosMovCaja
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerListadoDatosMovCaja]
DESCRIPCION: Obtiene la lista de documentos segun los parametros de entrada
CREADO: <2012-07-26>
MODIFICADO: <2020-06-26> 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerListadoDatosMovCaja]
    (
      @sDatabase_Name				VARCHAR(30)			= NULL ,
     
      @sField_Name					VARCHAR(30)			= NULL ,
   
      @sValor						VARCHAR(30)			= NULL ,
       
      @bAvanzada					BIT					= NULL,
      @bUsaOperadorLogicoAND		BIT					= NULL,
      
      @bAplica_Anulado				BIT					= NULL,
      @bAnulado						BIT					= NULL,
      
      @bAplica_Fecha				BIT					= NULL,
      @dFecha_Desde					SMALLDATETIME		= NULL,
      @dFecha_Hasta					SMALLDATETIME		= NULL,
      
      @bAplica_Caja					BIT					= NULL,
      @sCaja						CHAR(6)				= NULL,
      
      @bAplica_Tipo_mov				BIT					= NULL,
      @sTipo_mov					CHAR(2)				= NULL,
      
      @bAplica_Num_pago				BIT					= NULL,
      @sNum_Pago					VARCHAR(20)			= NULL,
      
      @bAplica_Banco				BIT					= NULL,
      @sBanco						CHAR(6)				= NULL,
      
      @bAplica_Tarjeta				BIT					= NULL,
      @sTarjeta						CHAR(6)				= NULL,
      
      @bAplica_Cta_ing				BIT					= NULL,
      @sCta_ing						CHAR(20)			= NULL,
      
      @bAplica_Monto				BIT					= NULL,
      @dMonto_Desde					decimal(18, 2)		= NULL,
      @dMonto_Hasta					decimal(18, 2)		= NULL,
      
      @bAplica_Sucursal				BIT					= NULL,
	  @sSucursal					CHAR(10)			= NULL,
      
      @bAplica_Nro_Comrpobante		BIT					= NULL,
      @sNro_Comrpobante				INT					= NULL,
     	  
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
			
          SET @SqlString = N'USE ' + CONVERT(NVARCHAR(100), @sDataBase_Name) + ' SELECT TOP(500) *, (case when monto_d > 0 then monto_d else monto_h end) as monto    
					   FROM ' + CONVERT(NVARCHAR(100), 'saMovimientoCaja') + ' WHERE '
		
		IF (@sValor <> '')
			BEGIN
				IF ( @iOpcion = 0 )--Inicia en
					BEGIN
						SET @SqlString = @SqlString + CONVE
```
