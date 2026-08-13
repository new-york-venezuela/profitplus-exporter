# SP: pActualizarRenglonesArtIdentificador
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtIdentificadorReng`](../tables/saArtIdentificadorReng.md)
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			[pActualizarRenglonesIdentificador]
DESCRIPCION: 
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pActualizarRenglonesArtIdentificador]
    (
      @sCo_Art CHAR(30) ,
      @sCo_ArtOri CHAR(30) ,
      @iReng_Num INT ,
      @iReng_NumOri INT ,
      @sCo_Iden CHAR(30) ,
      @sCo_Uni CHAR(6) ,
      @sDes_Uni CHAR(60) = NULL ,
      @sDes_Iden VARCHAR(60) ,
      @deCantidad DECIMAL(18, 5) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL 
	
    )
AS 
    BEGIN  

        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
		
		 IF EXISTS ( SELECT  *
                    FROM    dbo.saArticulo
                    WHERE   @sCo_Iden = co_art ) 
            BEGIN
		
                DECLARE @MensajeError VARCHAR(256)              
                SET @MensajeError = 'El renglón ' + RTRIM(LTRIM(STR(@iReng_Num)))
                    + ' posee un identificador que ya corresponde a un artículo.'
                RAISERROR(@MensajeError,16,1)
                RETURN ;
            END
		
        UPDATE
            dbo.saArtIdentificadorReng
        SET co_art = @sCo_Art, reng_num = @iReng_Num, co_iden = @sCo_Iden, co_uni = @sCo_Uni, des_iden = @sDes_Iden,
            cantidad = @deCantidad, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(),
            trasnfe = @sTrasnfe, revisado = @sRevisado
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_art = @sCo_ArtOri
            AND reng_num = @iReng_NumOri
    
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
	
        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp
	
        IF @dtFe_In IS NOT NULL 
            BEGIN
		-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Su
```
