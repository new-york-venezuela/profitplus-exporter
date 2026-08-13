# SP: pActualizarFactDocCompraTasaMoneda
**Tipo**: Actualizar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)

## Código (excerpt)
```sql
/****** Object:  StoredProcedure [dbo].[pActualizarFactDocCompraTasaMoneda]    Script Date: 12/12/2011 11:24:48 ******/
CREATE PROCEDURE [dbo].[pActualizarFactDocCompraTasaMoneda]
(		
		@sDoc_num			CHAR(20),
		@sCo_tipo_doc       CHAR(6),
        @sCo_mone			CHAR(6),
        @deTasa		        DECIMAL (21,8),
		@deOtros1		    DECIMAL (18,2),
        @sCo_Us_Mo			CHAR(6) ,
		@sCo_Sucu_Mo		CHAR(6)				=	NULL ,
		@sMaquina			VARCHAR(60)			=	NULL ,
		@sCampos			VARCHAR(MAX)		=	NULL ,
		@sRevisado			CHAR(1) ,
		@sTrasnfe			CHAR(1) ,
		@tsValidador		TIMESTAMP			=	NULL ,
		@gRowguid			UNIQUEIDENTIFIER	=	NULL 
	)
AS
BEGIN
			DECLARE @TableTimestampdFACT TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguidFACT UNIQUEIDENTIFIER
            )

			DECLARE @TableTimestampdDOC TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguidDOC UNIQUEIDENTIFIER
            )
			
		DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOriFACT UNIQUEIDENTIFIER
		DECLARE @rowGuidOriDOC UNIQUEIDENTIFIER
		DECLARE @sPistaMensaje VARCHAR(MAX)
IF @sCo_tipo_doc ='FACT'
BEGIN
            UPDATE saFacturaCompra 
				SET -- tasa		    =		@deTasa,
					-- co_mone		    =		@sCo_mone, 
					otros1		    =		@deOtros1, 
					total_neto      =       (total_neto-otros1) + @deOtros1, 
					saldo           =       (saldo-otros1) + @deOtros1, 
					co_us_mo		=		@sCo_Us_Mo,
					co_sucu_mo		=		@sCo_Sucu_Mo
						OUTPUT inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
				      INTO @TableTimestampdFACT
                  WHERE doc_num		=		@sDoc_num

			UPDATE saDocumentoCompra 
				SET	-- tasa		    =		@deTasa,
					-- co_mone		    =		@sCo_mone,
					otros1		    =		@deOtros1, 
					total_neto      =       (total_neto-otros1) + @deOtros1, 
					saldo           =       (saldo-otros1) + @deOtros1, 
					co_us_mo		=		@sCo_Us_Mo,
					co_sucu_mo		=		@sCo_Sucu_Mo
					OUTPUT inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
				      INTO @TableTimestampdDOC
				  WHERE nro_doc		=		@sDoc_num	AND 
						co_tipo_doc =		'FACT'

		SELECT
            @dtFe_In = fe_us_mo, @rowGuidOriFACT = rowguidFACT
        FROM
            @TableTimestampdFACT

		SELECT
            @rowGuidOriDOC = rowguidDOC
        FROM
```
