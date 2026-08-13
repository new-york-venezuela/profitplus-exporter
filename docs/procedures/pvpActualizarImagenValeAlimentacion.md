# SP: pvpActualizarImagenValeAlimentacion
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvValeAlimentacion`](../tables/pvValeAlimentacion.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pvpActualizarImagenValeAlimentacion
*DESCRIPCIÓN	: Actualiza una imagen
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [dbo].[pvpActualizarImagenValeAlimentacion]
    (
      @sCo_Vale CHAR(6) ,
      --@sVale_descrip VARCHAR(60) ,
      --@sCo_ValeOri CHAR(6) ,
      --@bInactivo CHAR(6) ,
      @baimagen VARBINARY (MAX)= NULL,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_us_mo CHAR (6),
      @sCo_sucu_mo CHAR (6) = NULL,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1)= NULL ,
      @sTrasnfe CHAR(1) = NULL,
      --@tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL 
    )
AS 
    BEGIN	

        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        UPDATE
            pvValeAlimentacion
        SET 
        
            co_vale = @sCo_Vale, 
           -- vale_descrip = @sVale_descrip,
           --  inactivo = @bInactivo,
            imagen = @baimagen, campo1 = @sCampo1,
            campo2 = @sCampo2, campo3 = @sCampo3, campo4 = @sCampo4, campo5 = @sCampo5, campo6 = @sCampo6,
            campo7 = @sCampo7, campo8 = @sCampo8, Co_us_mo = @sCo_us_mo,
              co_sucu_mo = @sCo_Sucu_mo, fe_us_mo = GETDATE(),
            revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_Vale = @sCo_Vale
            AND imagen = @baimagen
           -- AND validador = @tsValidador	

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_In IS NOT NULL 
            BEGIN
		-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_us_mo, @dtFecha =
```
